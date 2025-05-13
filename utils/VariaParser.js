export default class VariaPacketParser {
  constructor() {
    this.partial = null; // Temporary storage if an incomplete packet is received
  }

  /**
   * Call this method for each BLE packet received (up to 20 bytes).
   * If the data is complete, returns an array of vehicle objects.
   * If the packet is incomplete (not a multiple of 3 after header), stores it and waits for the next.
   *
   * @param {Buffer | number[]} packet - BLE packet (Array of bytes or Buffer)
   * @returns {Array<{ id: number, distance: number, speed: number }>} - Parsed vehicle data or empty array
   */
  push(packet) {
    const bytes = Buffer.isBuffer(packet) ? [...packet] : packet;
    if (bytes.length < 2) return [];

    let data;

    // Merge with previously stored partial data if it exists
    if (this.partial) {
      data = this.partial.concat(bytes.slice(1)); // Skip the header byte
      this.partial = null;
    } else {
      data = bytes.slice(1); // Skip the header byte
    }

    // If the length is a multiple of 3, parse it
    if (data.length % 3 === 0) {
      return this._parseVehicles(data);
    } else {
      // Store incomplete data for the next packet
      this.partial = data;
      return null;
    }
  }

  _parseVehicles(data) {
    const vehicles = [];
    for (let i = 0; i + 2 < data.length; i += 3) {
      vehicles.push({
        id: data[i],
        distance: data[i + 1],
        speed: data[i + 2],
      });
    }
    return vehicles;
  }
}
