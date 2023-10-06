import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const apiResult = await fetch("http://127.0.0.1:8080/shutdown", {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const resultJson = await apiResult.json();

  return Response.json(resultJson);
}
