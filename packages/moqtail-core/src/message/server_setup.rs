use crate::coding::{Decode, Encode, VarInt};
use crate::model::SetupParameter;
use bytes::{Buf, BufMut};

#[derive(Debug, Clone)]
pub struct ServerSetup {
    pub selected_version: VarInt,
    pub parameters: Vec<SetupParameter>,
}

impl Encode for ServerSetup {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.selected_version.encode(buf);
        VarInt(self.parameters.len() as u64).encode(buf);
        for p in &self.parameters {
            p.encode(buf);
        }
    }
}

impl<'a> Decode<'a> for ServerSetup {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let selected_version = VarInt::decode(buf)?;

        let num_params = VarInt::decode(buf)?.into_inner() as usize;
        let mut parameters = Vec::new();
        for _ in 0..num_params {
            parameters.push(SetupParameter::decode(buf)?);
        }

        Ok(ServerSetup {
            selected_version,
            parameters,
        })
    }
}
