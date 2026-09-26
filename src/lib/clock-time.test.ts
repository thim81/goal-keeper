import { describe, expect, it } from "vitest";
import { parseClockTime } from "./clock-time";

describe("parseClockTime", () => {
  it("parses clock times and rejects invalid or incomplete values", () => {
    expect(parseClockTime("00:00")).toEqual({ hours: 0, minutes: 0 });
    expect(parseClockTime("23:59")).toEqual({ hours: 23, minutes: 59 });
    for (const time of ["", "9:30", "24:00", "12:60", "12:30:00", " 12:30"]) {
      expect(parseClockTime(time)).toBeNull();
    }
  });
});
