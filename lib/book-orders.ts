import type { Db } from "mongodb";
export async function finalizePaidBookInventory(db:Db,requestId:string){
 const requests=db.collection("platform_requests");
 const order=await requests.findOne({requestId,kind:"book_order",paymentStatus:"paid"});
 if(!order||!Array.isArray(order.items))return {status:"not_applicable" as const};
 const claim=await requests.updateOne({requestId,kind:"book_order",paymentStatus:"paid",inventoryStatus:{$nin:["processing","deducted"]}},{$set:{inventoryStatus:"processing",inventoryProcessingAt:new Date()}});
 if(claim.modifiedCount!==1)return {status:"already_processing" as const};
 try{
  for(const raw of order.items){
   if(!raw||typeof raw!=="object")continue;
   const item=raw as Record<string,unknown>,bookId=typeof item.bookId==="string"?item.bookId:"",quantity=Number(item.quantity);
   if(!bookId||!Number.isInteger(quantity)||quantity<1)throw new Error("Invalid order item");
   if(item.productType!=="physical")continue;
   const result=await db.collection("etzan_books").updateOne({bookId,productType:"physical",stock:{$gte:quantity}},{$inc:{stock:-quantity,sold:quantity},$set:{updatedAt:new Date()}});
   if(result.modifiedCount!==1)throw new Error("Insufficient stock for "+bookId);
  }
  await requests.updateOne({requestId,inventoryStatus:"processing"},{$set:{inventoryStatus:"deducted",inventoryDeductedAt:new Date()}});
  return {status:"deducted" as const};
 }catch(error){
  console.error("Paid ETZAN book order inventory reconciliation required",requestId,error);
  await requests.updateOne({requestId,inventoryStatus:"processing"},{$set:{inventoryStatus:"issue",inventoryIssueAt:new Date(),inventoryIssue:"تم الدفع، لكن تعذر خصم كمية أحد الكتب من المخزون. يلزم تدخل الإدارة."}});
  return {status:"issue" as const};
 }
}
