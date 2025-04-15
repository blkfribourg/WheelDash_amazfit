export default class EngoComms {
  init() {}
  getHexText(text, lpadding, rpadding) {
    const encoder = new TextEncoder();
    let hexText = Array.from(encoder.encode(text));
    const textLength = text.length;

    if (lpadding > 0) {
      const leftPadding = new Array(lpadding - textLength).fill(0x24);
      hexText = [...leftPadding, ...hexText];
    }

    if (rpadding > 0) {
      const rightPadding = new Array(rpadding).fill(0x24);
      hexText = [...hexText, ...rightPadding];
    }

    return hexText;
  }

  encodeInt16(val) {
    return [(val >> 8) & 0xff, val & 0xff];
  }

  getWriteCmd(text, x, y, r, f, c) {
    const hexText = this.getHexText(text, 0, 0);
    const cmd = [0xff, 0x37, 0x00, 0x0d + hexText.length];

    // cmd.push(...this.encodeInt16(x));
    //cmd.push(...this.encodeInt16(y));
    cmd.push(r);
    cmd.push(f);
    cmd.push(c);
    // cmd.push(...hexText);
    cmd.push(0x00);
    cmd.push(0xaa);

    return cmd;
  }
  getClearScreenCmd() {
    return [0xff, 0x01, 0x00, 0x05, 0xaa];
  }

  writeTextDefault(text, x, y) {
    const r = 4; // default rotation
    const c = 15;
    const f = 3; // default font

    const cmd = this.getWriteCmd(text, x, y, r, f, c);
    const clearCmd = this.getClearScreenCmd();
    const combinedCmd = [...clearCmd, ...cmd];
    return combinedCmd;
  }
}
