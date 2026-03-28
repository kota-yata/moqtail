use crate::coding::{Decode, Encode, VarInt};
use crate::model::SetupParameter;
use bytes::{Buf, BufMut};

#[derive(Debug, Clone)]
pub struct ClientSetup {
    pub versions: Vec<VarInt>,
    pub parameters: Vec<SetupParameter>,
}

impl Encode for ClientSetup {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        VarInt(self.versions.len() as u64).encode(buf);
        for v in &self.versions {
            v.encode(buf);
        }
        VarInt(self.parameters.len() as u64).encode(buf);
        for p in &self.parameters {
            p.encode(buf);
        }
    }
}

impl<'a> Decode<'a> for ClientSetup {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let num_versions = VarInt::decode(buf)?.into_inner() as usize;
        let mut versions = Vec::with_capacity(num_versions);
        for _ in 0..num_versions {
            versions.push(VarInt::decode(buf)?);
        }

        let num_params = VarInt::decode(buf)?.into_inner() as usize;
        let mut parameters = Vec::new();
        for _ in 0..num_params {
            parameters.push(SetupParameter::decode(buf)?);
        }

        Ok(ClientSetup {
            versions,
            parameters,
        })
    }
}
