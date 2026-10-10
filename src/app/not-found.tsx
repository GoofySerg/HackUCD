import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <h1 className="text-5xl font-bold tracking-tight">404</h1>
      <p className="mt-2 text-muted-foreground">This page could not be found.</p>
      <Link href="/" className="mt-6">
        <Button>Go home</Button>
      </Link>
    </div>
  );
}
