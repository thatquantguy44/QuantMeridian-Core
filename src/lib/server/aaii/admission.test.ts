import {describe,expect,it} from "vitest";
import {assertAaiiReaderAdmission} from "./admission";
const reader=()=>({transactionReadOnly:true,canSelectGold:true,ownsGold:false,hasGoldWritePrivileges:false,
  isSuperuser:false,canCreateRoles:false,canCreateDatabases:false,canReplicate:false,bypassesRls:false,
  hasUnapprovedRoleMembership:false,hasOtherApplicationRelationPrivileges:false,roleMatchesApprovedReader:true});
describe("AAII consumer-role admission",()=>{
  it("accepts an explicitly approved read-only consumer with narrow privileges",()=>expect(()=>assertAaiiReaderAdmission(reader())).not.toThrow());
  it.each(['ownsGold','hasGoldWritePrivileges','isSuperuser','canCreateRoles','canCreateDatabases','canReplicate','bypassesRls','hasUnapprovedRoleMembership','hasOtherApplicationRelationPrivileges'] as const)("rejects %s even inside a read-only transaction",field=>{
    expect(()=>assertAaiiReaderAdmission({...reader(),[field]:true})).toThrow("READER_NOT_ADMITTED");
  });
  it.each(['transactionReadOnly','canSelectGold','roleMatchesApprovedReader'] as const)("requires affirmative %s",field=>{
    expect(()=>assertAaiiReaderAdmission({...reader(),[field]:false})).toThrow("READER_NOT_ADMITTED");
    expect(()=>assertAaiiReaderAdmission({...reader(),[field]:undefined})).toThrow("READER_NOT_ADMITTED");
  });
  it("rejects missing evidence rather than assuming least privilege",()=>{
    expect(()=>assertAaiiReaderAdmission({})).toThrow("READER_NOT_ADMITTED");
  });
});
