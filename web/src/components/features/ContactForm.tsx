"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { submitInquiry } from "@/app/actions/listing-inquiry";

const ContactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(5).max(2000),
});

type ContactFormValues = z.infer<typeof ContactSchema>;

type Props = {
  listingId: string;
};

export default function ContactForm({ listingId }: Props) {
  const t = useTranslations("contactForm");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(ContactSchema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
  });

  const onSubmit = (values: ContactFormValues) => {
    setStatus("idle");
    startTransition(async () => {
      const res = await submitInquiry({
        listing_id: listingId,
        ...values,
      });
      if (res.ok) {
        setStatus("ok");
        reset();
      } else {
        setStatus("error");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 p-5"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          {t("name")}
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600"
          {...register("name")}
        />
        {errors.name && (
          <span className="text-sm text-red-600">{t("errors.name")}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          {t("email")}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600"
          {...register("email")}
        />
        {errors.email && (
          <span className="text-sm text-red-600">{t("errors.email")}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium">
          {t("phone")}
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600"
          {...register("phone")}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="message" className="text-sm font-medium">
          {t("message")}
        </label>
        <textarea
          id="message"
          rows={5}
          className="rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600"
          {...register("message")}
        />
        {errors.message && (
          <span className="text-sm text-red-600">
            {t("errors.message")}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-lg bg-emerald-700 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>

      {status === "ok" && (
        <p className="text-sm text-emerald-700">{t("success")}</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-600">{t("error")}</p>
      )}
    </form>
  );
}