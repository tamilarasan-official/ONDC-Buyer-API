import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { JwtAuthGuard } from "src/authentication/jwt-auth.guard";
import { UpdateAddressDto, UpdateUserDto } from "./dto/update-user.dto";
import { CreateAddressDto } from "./dto/create-user.dto";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  async profile(@Req() req) {
    return this.userService.profile(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("profile")
  async updateProfile(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateProfile(req.user, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("address")
  async addAddress(@Req() req, @Body() createAddressDto: CreateAddressDto) {
    return this.userService.addAddress(req.user, createAddressDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("address/:id")
  async updateAddress(@Req() req, @Body() updateAddressDto: UpdateAddressDto) {
    return this.userService.updateAddress(req.user, updateAddressDto);
  }

  @Get("address/:id")
  async getAddresses(@Param("id") id: number) {
    return this.userService.getAddress(id);
  }

  @Delete("address/:id")
  async deleteAddress(@Param("id") id: number) {
    return this.userService.deleteAddress(id);
  }
}
