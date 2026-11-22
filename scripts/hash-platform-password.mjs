import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const terminal = createInterface({ input: stdin, output: stdout });
try {
  const password = await terminal.question("كلمة مرور مدير المنصة (12 حرفاً على الأقل): ");
  if (password.length < 12) {
    throw new Error("يجب أن تحتوي كلمة المرور على 12 حرفاً على الأقل.");
  }
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex");
  stdout.write("\nPLATFORM_ADMIN_PASSWORD_HASH=scrypt$" + salt + "$" + hash + "\n");
} catch (error) {
  console.error(error instanceof Error ? error.message : "تعذر إنشاء تجزئة كلمة المرور.");
  process.exitCode = 1;
} finally {
  terminal.close();
}
