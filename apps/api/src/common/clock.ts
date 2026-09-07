import { Injectable } from "@nestjs/common";

// Rules that compare ages against the present read the time here, so a test can move it.
export abstract class Clock {
  abstract now(): Date;
}

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
