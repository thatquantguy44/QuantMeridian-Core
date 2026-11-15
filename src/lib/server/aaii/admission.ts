export interface AaiiReaderEvidence {
  transactionReadOnly:boolean;
  canSelectGold:boolean;
  roleMatchesApprovedReader:boolean;
  ownsGold:boolean;
  hasGoldWritePrivileges:boolean;
  isSuperuser:boolean;
  canCreateRoles:boolean;
  canCreateDatabases:boolean;
  canReplicate:boolean;
  bypassesRls:boolean;
  hasUnapprovedRoleMembership:boolean;
  hasOtherApplicationRelationPrivileges:boolean;
}
/** A one-off read-only audit with a writer does not admit that account as a consumer. */
export function assertAaiiReaderAdmission(value:unknown):asserts value is AaiiReaderEvidence {
  if(!value||typeof value!=="object")throw new Error("READER_NOT_ADMITTED");
  const e=value as Record<string,unknown>;
  const required=['transactionReadOnly','canSelectGold','roleMatchesApprovedReader'];
  const forbidden=['ownsGold','hasGoldWritePrivileges','isSuperuser','canCreateRoles','canCreateDatabases',
    'canReplicate','bypassesRls','hasUnapprovedRoleMembership','hasOtherApplicationRelationPrivileges'];
  if(required.some(k=>e[k]!==true)||forbidden.some(k=>e[k]!==false))throw new Error("READER_NOT_ADMITTED");
}
