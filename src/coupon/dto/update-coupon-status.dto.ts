import { IsDefined, IsIn, IsNotEmpty } from "class-validator";
import { CouponStatus } from "../entities/coupon.entity";

export class UpdateCouponStatusDto {
  @IsDefined({ message: "status is required" })
  @IsNotEmpty({ message: "status must not be empty" })
  @IsIn([CouponStatus.ACTIVE, CouponStatus.INACTIVE], {
    message: "status must be 'active' or 'inactive'",
  })
  status!: CouponStatus.ACTIVE | CouponStatus.INACTIVE;
}
