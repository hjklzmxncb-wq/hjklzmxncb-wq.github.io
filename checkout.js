(async () => {
  const cfg = window.HOPPANG_CONFIG || {};
  const works = window.HOPPANG_WORKS || [];
  const Auth = window.HoppangAuth;

  const qs = new URLSearchParams(location.search);
  const workId = qs.get("work");
  const work = works.find((w) => w.id === workId);

  const fail = (message) => {
    document.querySelector("#checkoutTitle").textContent =
      "결제를 시작할 수 없어요.";

    document.querySelector("#orderSummary").innerHTML = `
      <div class="info-box">
        ${message}
        <br><br>
        <a class="secondary-btn" href="index.html#/store">
          스토어로 돌아가기
        </a>
      </div>
    `;
  };

  try {
    if (!work) {
      fail("작품을 찾지 못했습니다.");
      return;
    }

    if (!Auth) {
      fail("로그인 시스템을 불러오지 못했습니다.");
      return;
    }

    await Auth.refresh();

    if (!Auth.user) {
      fail("로그인이 필요합니다. 메인 사이트에서 로그인해주세요.");
      return;
    }

    if (!cfg.API_BASE_URL) {
      fail("결제 서버 주소가 설정되지 않았습니다.");
      return;
    }

    if (!cfg.TOSS_CLIENT_KEY) {
      fail("토스 클라이언트 키가 설정되지 않았습니다.");
      return;
    }

    const token = await Auth.token();

    if (!token) {
      fail("로그인 세션이 만료되었습니다.");
      return;
    }

    const apiBase = cfg.API_BASE_URL.replace(/\/$/, "");

    // 서버에서 1,000원 주문 생성
    const response = await fetch(`${apiBase}/create-order`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: cfg.SUPABASE_ANON_KEY
      },

      body: JSON.stringify({
        workId: work.id
      })
    });

    const order = await response.json();

    if (!response.ok) {
      if (order.alreadyPurchased) {
        location.href = "index.html#/my-library";
        return;
      }

      throw new Error(
        order.error ||
        order.message ||
        "주문 생성에 실패했습니다."
      );
    }

    const amount = Number(order.amount);

    document.querySelector("#checkoutTitle").textContent = work.title;

    document.querySelector("#orderSummary").innerHTML = `
      <div class="summary-cover cover ${work.cover}">
        <div class="cover-copy">
          <div class="cover-title">${work.title}</div>
        </div>
      </div>

      <h2>${work.title}</h2>
      <p>${work.subtitle || ""}</p>

      <div class="summary-line">
        <span>상품 금액</span>
        <strong>${amount.toLocaleString()}원</strong>
      </div>

      <div class="summary-line total">
        <span>총 결제금액</span>
        <strong>${amount.toLocaleString()}원</strong>
      </div>
    `;

    const tossPayments = TossPayments(cfg.TOSS_CLIENT_KEY);

    // Supabase user.id는 UUID라 회원별 customerKey로 사용
    const widgets = tossPayments.widgets({
      customerKey: Auth.user.id
    });

    await widgets.setAmount({
      currency: "KRW",
      value: amount
    });

    await Promise.all([
      widgets.renderPaymentMethods({
        selector: "#payment-method",
        variantKey: "DEFAULT"
      }),

      widgets.renderAgreement({
        selector: "#agreement",
        variantKey: "AGREEMENT"
      })
    ]);

    const payButton = document.querySelector("#payNow");

    payButton.disabled = false;
    payButton.textContent =
      `${amount.toLocaleString()}원 결제하기`;

    payButton.onclick = async () => {
      payButton.disabled = true;

      try {
        await widgets.requestPayment({
          orderId: order.orderId,

          // 최대 길이 방지
          orderName: work.title.slice(0, 100),

          successUrl:
            new URL("payment-success.html", location.href).href,

          failUrl:
            new URL("payment-fail.html", location.href).href,

          customerEmail:
            Auth.user.email || undefined
        });
      } catch (error) {
        payButton.disabled = false;

        // 사용자가 직접 결제창 닫은 경우
        if (error?.code !== "USER_CANCEL") {
          alert(
            error?.message ||
            "결제창을 열지 못했습니다."
          );
        }
      }
    };
  } catch (error) {
    console.error(error);

    fail(
      error instanceof Error
        ? error.message
        : "결제를 준비하는 중 오류가 발생했습니다."
    );
  }
})();
