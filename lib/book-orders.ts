import type { Db } from "mongodb";
export async function finalizePaidBookInventory(db:Db,requestId:string){
 const requests=db.collection("platform_requests");
 const order=await requests.findOne({requestId,kind:"book_order",paymentStatus:"paid"});
 if(!order||!Array.isArray(order.items))return {status:"not_applicable" as const};
 const wasReserved=order.inventoryStatus==="reserved";
 const claim=await requests.updateOne({requestId,kind:"book_order",paymentStatus:"paid",inventoryStatus:{$nin:["processing","deducted"]}},{$set:{inventoryStatus:"processing",inventoryProcessingAt:new Date()}});
 if(claim.modifiedCount!==1)return {status:"already_processing" as const};
 try{
  for(const raw of order.items){
   if(!raw||typeof raw!=="object")continue;
   const item=raw as Record<string,unknown>,bookId=typeof item.bookId==="string"?item.bookId:"",quantity=Number(item.quantity);
   if(!bookId||!Number.isInteger(quantity)||quantity<1)throw new Error("Invalid order item");
   if(item.productType!=="physical")continue;
   const filter=wasReserved?{bookId,productType:"physical",reserved:{$gte:quantity}}:{bookId,productType:"physical",stock:{$gte:quantity}};
   const update=wasReserved?{$inc:{reserved:-quantity,sold:quantity},$set:{updatedAt:new Date()}}:{$inc:{stock:-quantity,sold:quantity},$set:{updatedAt:new Date()}};
   const result=await db.collection("etzan_books").updateOne(filter,update);
   if(result.modifiedCount!==1)throw new Error("Insufficient stock for "+bookId);
  }
  await requests.updateOne({requestId,inventoryStatus:"processing"},{$set:{inventoryStatus:"deducted",inventoryDeductedAt:new Date()}});
  return {status:"deducted" as const};
 }catch(error){
  console.error("Paid ETZAN book order inventory reconciliation required",requestId,error);
  await requests.updateOne({requestId,inventoryStatus:"processing"},{$set:{inventoryStatus:"issue",inventoryIssueAt:new Date(),inventoryIssue:"تم الدفع، لكن تعذر إتمام حركة المخزون. يلزم تدخل الإدارة."}});
  return {status:"issue" as const};
 }
}
export async function releasePendingBookInventory(db:Db,requestId:string){
 const requests=db.collection("platform_requests");
 const order=await requests.findOne({requestId,kind:"book_order",inventoryStatus:"reserved"});
 if(!order||!Array.isArray(order.items))return;
 const claim=await requests.updateOne({requestId,kind:"book_order",inventoryStatus:"reserved"},{$set:{inventoryStatus:"releasing"}});
 if(claim.modifiedCount!==1)return;
 try{
  for(const raw of order.items){
   if(!raw||typeof raw!=="object")continue;
   const item=raw as Record<string,unknown>,bookId=typeof item.bookId==="string"?item.bookId:"",quantity=Number(item.quantity);
   if(item.productType!=="physical"||!bookId||!Number.isInteger(quantity)||quantity<1)continue;
   const result=await db.collection("etzan_books").updateOne({bookId,productType:"physical",reserved:{$gte:quantity}},{$inc:{stock:quantity,reserved:-quantity},$set:{updatedAt:new Date()}});
   if(result.modifiedCount!==1)throw new Error("Unable to release reserved quantity for "+bookId);
  }
  await requests.updateOne({requestId,inventoryStatus:"releasing"},{$set:{inventoryStatus:"released",inventoryReleasedAt:new Date()}});
 }catch(error){
  console.error("ETZAN book reservation release requires manual reconciliation",requestId,error);
  await requests.updateOne({requestId,inventoryStatus:"releasing"},{$set:{inventoryStatus:"issue",inventoryIssueAt:new Date()}});
 }
}

export async function expireStaleBookReservations(db:Db){
 const cutoff=new Date(Date.now()-24*60*60*1000);
 const expired=await db.collection("platform_requests").find({kind:"book_order",inventoryStatus:"reserved",paymentStatus:{$ne:"paid"},status:{$in:["pending_review","awaiting_payment"]},createdAt:{$lt:cutoff}},{projection:{_id:0,requestId:1}}).limit(100).toArray();
 for(const row of expired){
  if(typeof row.requestId!=="string")continue;
  await db.collection("platform_requests").updateOne({requestId:row.requestId,inventoryStatus:"reserved",paymentStatus:{$ne:"paid"}},{$set:{status:"expired",inventoryStatus:"released",inventoryReleasedAt:new Date(),expiredAt:new Date()}});
  const order=await db.collection("platform_requests").findOne({requestId:row.requestId},{projection:{items:1}});
  if(Array.isArray(order?.items))for(const raw of order.items){
   if(!raw||typeof raw!=="object")continue;
   const item=raw as Record<string,unknown>,bookId=typeof item.bookId==="string"?item.bookId:"",quantity=Number(item.quantity);
   if(item.productType==="physical"&&bookId&&Number.isInteger(quantity)&&quantity>0)await db.collection("etzan_books").updateOne({bookId,reserved:{$gte:quantity}},{$inc:{stock:quantity,reserved:-quantity},$set:{updatedAt:new Date()}});
  }
 }
}
