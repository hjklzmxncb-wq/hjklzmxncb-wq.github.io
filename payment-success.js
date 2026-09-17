(async () => {
  const title = document.querySelector("#resultTitle");
  const text = document.querySelector("#resultText");
  const link = document.querySelector("#resultLink");

  const cfg = window.HOPPANG_CONFIG || {};
  const Auth = window.HoppangAuth;

  try {
    const params = new URLSearchParams(location.search);

    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount"));

    if (
      !paymentKey ||
      !orderId ||
      !Number.isInteger(amount)
    ) {
      throw new Error("결제 인증 정보가 올바르지 않습니다.");
    }

    await Auth.refresh();

    const token = await Auth.token();

    if (!token) {
      throw new Error(
        "로그인 세션이 만료되었습니다. 다시 로그인해주세요."
      );
    }

    const apiBase =
      cfg.API_BASE_URL.replace(/\/$/, "");

    // Supabase Edge Function에서 토스 승인
    const response = await fetch(
      `${apiBase}/confirm-payment`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: cfg.SUPABASE_ANON_KEY
        },

        body: JSON.stringify({
          paymentKey,
          orderId,
          amount
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        "결제 승인에 실패했습니다."
      );
    }

    // 구매내역 다시 가져오기
    await Auth.refresh();

    title.textContent = "구매가 완료되었습니다.";

    text.textContent =
      "작품이 내 서재에 등록되었습니다.";

    link.textContent = "내 서재로";
    link.href = "index.html#/my-library";
    link.hidden = false;
  } catch (error) {
    console.error(error);

    title.textContent =
      "결제를 완료하지 못했습니다.";

    text.textContent =
      error instanceof Error
        ? error.message
        : "결제 승인 중 오류가 발생했습니다.";

    link.textContent = "스토어로 돌아가기";
    link.href = "index.html#/store";
    link.hidden = false;
  }
})();
