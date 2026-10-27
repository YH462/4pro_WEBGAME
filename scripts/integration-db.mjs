import EmbeddedPostgres from 'embedded-postgres';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

// Isolated from the development database on 5432 and the public server.
const databaseDir=resolve('.local/ui-production-integration/postgres');
const pg=new EmbeddedPostgres({databaseDir,persistent:true,user:'fourpro',password:'integration_test_only',port:55436,
  authMethod:'scram-sha-256',initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:console.error});
if(!existsSync(resolve(databaseDir,'PG_VERSION')))await pg.initialise();
await pg.start();
const client=pg.getPgClient('postgres','127.0.0.1');
await client.connect();
try {
  if(!(await client.query("SELECT 1 FROM pg_database WHERE datname='fourpro_ui_integration'")).rowCount)await pg.createDatabase('fourpro_ui_integration');
}finally{await client.end();}
console.log('Integration database ready: 127.0.0.1:55436/fourpro_ui_integration');
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;await pg.stop();process.exit(0);};
process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
setInterval(()=>{},60000);
