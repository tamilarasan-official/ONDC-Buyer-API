import { Injectable } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async storeCreation(to: string, storeDetails: any) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: "Your Store has been created!",
        template: "store-registration",
        context: {
          store: storeDetails,
        },
      });

      console.log("Email sent successfully");
    } catch (error) {
      console.error("Error sending email:", error);
    }
  }

  async forgotPassword(to: string, userDetails: any) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: "Password reset requested",
        template: "forgot-password",
        context: {
          resetLink: userDetails.resetLink,
          userName: userDetails.userName,
        },
      });

      console.log("Email sent successfully");
    } catch (error) {
      console.error("Error sending email:", error);
    }
  }
}
