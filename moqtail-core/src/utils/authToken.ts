import { concatUint8Arrays, serializeQuicVarInt, stringToVarBytes } from "bytes";

export const serializeAuthToken = (token: TOKEN): Uint8Array => {
  const aliasBytes = serializeQuicVarInt(token.aliasType);
  let tokenAliasBytes = new Uint8Array(0);
  let tokenTypeBytes = new Uint8Array(0);
  let tokenValueBytes = new Uint8Array(0);
  switch (token.aliasType) {
    case AUTH_TOKEN_ALIAS_TYPE.DELETE:
      tokenAliasBytes = serializeQuicVarInt(token.tokenAlias ?? 0);
      break;
    case AUTH_TOKEN_ALIAS_TYPE.REGISTER:
      tokenAliasBytes = serializeQuicVarInt(token.tokenAlias ?? 0);
      tokenTypeBytes = serializeQuicVarInt(token.tokenType ?? 0);
      tokenValueBytes = stringToVarBytes(token.tokenValue ?? '');
      break;
    case AUTH_TOKEN_ALIAS_TYPE.USE_ALIAS:
      tokenAliasBytes = serializeQuicVarInt(token.tokenAlias ?? 0);
      break;
    case AUTH_TOKEN_ALIAS_TYPE.USE_VALUE:
      tokenTypeBytes = serializeQuicVarInt(token.tokenType ?? 0);
      tokenValueBytes = stringToVarBytes(token.tokenValue ?? '');
      break;
  }
  return concatUint8Arrays([aliasBytes, tokenAliasBytes, tokenTypeBytes, tokenValueBytes]);
}

export const AUTH_TOKEN_ALIAS_TYPE = {
  DELETE: 0x0,
  REGISTER: 0x1,
  USE_ALIAS: 0x2,
  USE_VALUE: 0x3,
}
export type AUTH_TOKEN_ALIAS_TYPE = ObjectValueList<typeof AUTH_TOKEN_ALIAS_TYPE>;

export interface TOKEN {
  aliasType: AUTH_TOKEN_ALIAS_TYPE,
  tokenAlias?: number,
  tokenType?: number,
  tokenValue?: string,
}
