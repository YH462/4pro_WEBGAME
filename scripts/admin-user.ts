import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { hashAdminPassword } from "../src/lib/admin-password";
const [action,rawUsername,rawTarget]=process.argv.slice(2);
const username=rawUsername?.trim().toLowerCase(),target=rawTarget?.trim().toLowerCase();
const validName=(name:string|undefined)=>!!name&&/^[a-z0-9][a-z0-9_-]{2,31}$/.test(name);
if(!["create","reset","disable","rename"].includes(action)||!validName(username)||action==="rename"&&!validName(target)) throw new Error("Usage: npm run admin:user -- create|reset|disable USERNAME, or rename OLD_USERNAME NEW_USERNAME (3-32 letters, digits, _ or -)");
const db=new PrismaClient();
try {
  if(action==="rename") {
    await db.$transaction(async(tx)=>{
      const users=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "AdminUser" WHERE "username" = ${username} FOR UPDATE`;
      if(!users[0])throw new Error("Admin not found.");
      const existing=await tx.adminUser.findUnique({where:{username:target!},select:{id:true}});
      if(existing&&existing.id!==users[0].id)throw new Error("Target username is already in use.");
      await tx.adminUser.update({where:{id:users[0].id},data:{username:target!}});
    });
    console.log(`Admin username changed: ${username} -> ${target}. Password and sessions preserved.`);
  } else if(action==="disable") {
    await db.$transaction(async(tx)=>{
      const users=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "AdminUser" WHERE "username" = ${username} FOR UPDATE`;
      if(!users[0]) throw new Error("Admin not found.");
      await tx.adminUser.update({where:{id:users[0].id},data:{enabled:false}});
      await tx.adminSession.deleteMany({where:{adminId:users[0].id}});
    });
    console.log("Admin disabled and sessions revoked.");
  } else {
    const folder=path.resolve(".local/admin"); await mkdir(folder,{recursive:true});
    const filename=path.join(folder,`${username}-${Date.now()}-${randomBytes(4).toString("hex")}.json`);
    const password=randomBytes(24).toString("base64url");
    const passwordHash=await hashAdminPassword(password);
    // Save credentials before committing so a disk error cannot strand an active account.
    await writeFile(filename,JSON.stringify({username,password,loginPath:"/admin/login"},null,2),{flag:"wx",mode:0o600});
    await access(filename);
    if(action==="create") await db.adminUser.create({data:{username,passwordHash}});
    else await db.$transaction(async(tx)=>{
      const users=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "AdminUser" WHERE "username" = ${username} FOR UPDATE`;
      if(!users[0]) throw new Error("Admin not found.");
      await tx.adminUser.update({where:{id:users[0].id},data:{passwordHash,enabled:true}});
      await tx.adminSession.deleteMany({where:{adminId:users[0].id}});
    });
    console.log(`Admin ${action} completed. Credentials: ${filename}`);
  }
} finally { await db.$disconnect(); }
