export default class BatteryPercCompute {
  static computeBatteryPercentage(
    voltage,
    cellNbSerie,
    minCellVolt,
    maxCellVolt
  ) {
    if (voltage === undefined || voltage < 0) {
      return 0;
    }
    const minPackVolt = cellNbSerie * minCellVolt;
    const maxPackVolt = cellNbSerie * maxCellVolt;

    let percentage =
      ((voltage - minPackVolt) / (maxPackVolt - minPackVolt)) * 100;

    if (percentage > 100) {
      percentage = 100;
    } else if (percentage < 0) {
      percentage = 0;
    }

    return Math.round(percentage);
  }
}
