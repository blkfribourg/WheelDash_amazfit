import { Time } from "@zos/sensor";
export default class CurrentTime {
  constructor() {
    this.time = new Time();
  }
  getCurrentTime() {
    const currentTime =
      ("0" + this.time.getHours()).slice(-2) +
      ":" +
      ("0" + this.time.getMinutes()).slice(-2);

    return currentTime;
  }
}
