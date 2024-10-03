export const makeAcc = (addr: string) => {
  return {
    addr,
    sk: new Uint8Array(0),
  }
}
