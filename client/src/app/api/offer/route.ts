import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const apiResult = await fetch("http://127.0.0.1:8080/offer", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const offer = await apiResult.json();

  return Response.json(offer);
}
