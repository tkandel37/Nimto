import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class SecurityThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(request: { ip?: string }): Promise<string> {
    // Express resolves request.ip from the configured trusted proxy boundary.
    // Reading the left-most forwarded address directly would let clients evade
    // limits when a proxy appends to an attacker-supplied header.
    return request.ip || "unknown";
  }
}
