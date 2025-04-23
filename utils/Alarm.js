import { create, id } from "@zos/media";

export default class Alarm {
  constructor() {
    this.player = player = create(id.PLAYER);
  }

  playPWMAlarm() {
    this.player.setSource(player.source.FILE, {
      file: "08-15s-16000-1ch.opus",
    });
  }
}
