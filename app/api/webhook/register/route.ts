/* eslint-disable @typescript-eslint/no-unused-vars */
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    const WEBHOOK_SECRECT = process.env.WEBHOOK_SECRECT;
  
    if (!WEBHOOK_SECRECT) {
      throw new Error(
        "Please add WEBHOOK_SECRECT to your environment variables"
      );
    }
  
    const headerPayload = headers();
    const svix_id = (await headerPayload).get("svix-id");
    const svix_timestamp = (await headerPayload).get("svix-timestamp");
    const svix_signature = (await headerPayload).get("svix-signature");
  
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response("Error occurred --no svix headers", {
        status: 400,
      });
    }
  
    const payload = await req.json();
    const body = JSON.stringify(payload);
  
    const wh = new Webhook(WEBHOOK_SECRECT);
    let evt: WebhookEvent;
  
    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error verifying webhook:", err);
      return new Response("Error occurred", {
        status: 400,
      });
    }
  
    
    const eventType = evt.type;
    
    if (eventType === "user.created") {
      try {
        const { email_addresses, primary_email_address_id } = evt.data;
        console.log(evt.data);
        
        const primaryEmail = email_addresses.find(
          (email) => email.id === primary_email_address_id
        );
        if (!primaryEmail) {
          console.error("No primary email found");
          return new Response("No primary email found", { status: 400 });
        }
  
        // creating user in DB
        const newUser = await prisma.user.create({
          data: {
            id: evt.data.id!,
            email: primaryEmail.email_address,
            isSubscribed: false, 
          },
        });
     
      } catch (error) {
        console.error("Error while creating user in database:", error);
        return new Response("Error creating user", { status: 500 });
      }
    }
  
    return new Response("Webhook received successfully", { status: 200 });
  }