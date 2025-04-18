// Biến toàn cục
let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let ctx = null;
let scanning = false;
let lastScannedCode = null;
let scanTimeout = null;

// Phải đảm bảo canvas tồn tại trước khi lấy context
if (canvas) {
  ctx = canvas.getContext("2d");
} else {
  // Tạo canvas mới nếu không tìm thấy
  console.warn("Canvas không tồn tại, sẽ được tạo khi cần thiết");
}

// Khởi tạo camera khi trang đã tải xong
document.addEventListener("DOMContentLoaded", function() {
  video = document.getElementById("video");
  canvas = document.getElementById("canvas");
  
  if (canvas) {
    ctx = canvas.getContext("2d");
  }
  
  // Thêm event listeners cho các nút
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const manualBtn = document.getElementById("manualBtn");
  
  if (startBtn) startBtn.addEventListener("click", startCamera);
  if (pauseBtn) pauseBtn.addEventListener("click", pauseCamera);
  if (manualBtn) manualBtn.addEventListener("click", showManualInput);
  
  // Hiệu ứng đường quét
  const scanLine = document.querySelector(".scan-line");
  if (scanLine) {
    scanLine.style.animation = "scanAnimation 2s ease-in-out infinite alternate";
  }
  
  // Hiệu ứng góc quét
  const scanCorners = document.querySelectorAll(".scan-corner");
  if (scanCorners.length > 0 && typeof anime !== 'undefined') {
    anime({
      targets: scanCorners,
      borderColor: ["#00ffcc", "#00ccff"],
      loop: true,
      duration: 2000,
      easing: "easeInOutSine",
      direction: "alternate",
    });
  }
});

// Hàm bắt đầu camera
function startCamera() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(function (stream) {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();

        document.getElementById("startBtn").disabled = true;
        document.getElementById("pauseBtn").disabled = false;

        scanning = true;
        scan();

        showNotification("Đã kích hoạt camera, sẵn sàng quét mã", "success");
      })
      .catch(function (error) {
        console.error("Không thể truy cập camera: ", error);
        showNotification(
          "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.",
          "error"
        );
      });
  }
}

// Hàm tạm dừng camera
function pauseCamera() {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.srcObject = null;

    document.getElementById("startBtn").disabled = false;
    document.getElementById("pauseBtn").disabled = true;

    scanning = false;
    if (scanTimeout) {
      clearTimeout(scanTimeout);
    }

    showNotification("Đã tạm dừng quét mã", "success");
  }
}

// Hàm quét mã
function scan() {
  if (!scanning || !video || !canvas || !ctx) return;

  scanTimeout = setTimeout(() => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (canvas.width > 0 && canvas.height > 0) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      try {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data !== lastScannedCode) {
          lastScannedCode = code.data;
          processTicketCode(code.data);
        }
      } catch (e) {
        // Chỉ ghi log lỗi nghiêm trọng
        if (e.message !== "jsQR is not defined") {
          console.error("Lỗi quét mã QR:", e.message);
        }
      }
    }

    scan();
  }, 200);
}

// Hàm xử lý mã vé
function processTicketCode(code) {
  // Giảm bớt log không cần thiết
  // console.log("Mã đã quét:", code);

  // Giả lập kiểm tra mã vé
  const isValid = Math.random() > 0.2; // 80% cơ hội hợp lệ

  if (isValid) {
    showSuccessAnimation();
    updateTicketInfo(true, generateRandomTicketData());
    showNotification("Vé hợp lệ. Mời khách vào rạp!", "success");
  } else {
    showErrorAnimation();
    updateTicketInfo(false, { code: code });
    showNotification("Vé không hợp lệ hoặc đã được sử dụng!", "error");
  }

  addToHistory(code, isValid);
}

// Hiển thị thông báo
function showNotification(message, type) {
  const notification = document.getElementById("notification");
  notification.className = "notification";
  notification.classList.add("notification-" + type);
  notification.querySelector(".notification-message").textContent = message;

  if (type === "success") {
    notification.querySelector(".notification-icon").innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                `;
  } else {
    notification.querySelector(".notification-icon").innerHTML = `
                                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                `;
  }

  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

// Hiển thị animation thành công
function showSuccessAnimation() {
  const successAnimation = document.querySelector(".success-animation");
  successAnimation.classList.add("show");

  setTimeout(() => {
    successAnimation.classList.remove("show");
  }, 2000);
}

// Hiển thị animation lỗi
function showErrorAnimation() {
  const errorAnimation = document.querySelector(".error-animation");
  errorAnimation.classList.add("show");

  setTimeout(() => {
    errorAnimation.classList.remove("show");
  }, 2000);
}

// Cập nhật thông tin vé
function updateTicketInfo(isValid, ticketData) {
  const ticketInfo = document.getElementById("ticketInfo");
  const ticketStatus = ticketInfo.querySelector(".ticket-status");

  if (isValid) {
    ticketStatus.className = "ticket-status status-valid";
    ticketStatus.textContent = "Hợp lệ";

    // Cập nhật thông tin vé
    ticketInfo.querySelector(".detail-value:nth-of-type(1)").textContent =
      ticketData.movieName;
    ticketInfo.querySelector(".detail-value:nth-of-type(2)").textContent =
      ticketData.cinema;
    ticketInfo.querySelector(".detail-value:nth-of-type(3)").textContent =
      ticketData.date;
    ticketInfo.querySelector(".detail-value:nth-of-type(4)").textContent =
      ticketData.time;
    ticketInfo.querySelector(".detail-value:nth-of-type(5)").textContent =
      ticketData.seats;
    ticketInfo.querySelector(".detail-value:nth-of-type(6)").textContent =
      ticketData.code;

    // Thay đổi poster phim
    ticketInfo.querySelector(".movie-poster").src = ticketData.posterUrl;
  } else {
    ticketStatus.className = "ticket-status status-invalid";
    ticketStatus.textContent = "Không hợp lệ";

    // Cập nhật thông tin vé không hợp lệ
    ticketInfo.querySelector(".detail-value:nth-of-type(1)").textContent =
      "N/A";
    ticketInfo.querySelector(".detail-value:nth-of-type(2)").textContent =
      "N/A";
    ticketInfo.querySelector(".detail-value:nth-of-type(3)").textContent =
      "N/A";
    ticketInfo.querySelector(".detail-value:nth-of-type(4)").textContent =
      "N/A";
    ticketInfo.querySelector(".detail-value:nth-of-type(5)").textContent =
      "N/A";
    ticketInfo.querySelector(".detail-value:nth-of-type(6)").textContent =
      ticketData.code || "N/A";

    // Thay đổi poster phim
    ticketInfo.querySelector(".movie-poster").src =
      "https://via.placeholder.com/400x200/1a1f2c/e50914?text=Invalid+Ticket";
  }

  // Hiệu ứng hiển thị thông tin vé
  ticketInfo.classList.remove("active");
  void ticketInfo.offsetWidth; // Trigger reflow
  ticketInfo.classList.add("active");
}

// Thêm vào lịch sử quét
function addToHistory(code, isValid) {
  const historyList = document.querySelector(".history-list");
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

  const li = document.createElement("li");
  li.className = "history-item";
  li.innerHTML = `
                <span>Vé #${code.substr(0, 10)} - ${
    isValid ? "Hợp lệ" : "Không hợp lệ"
  }</span>
                <span class="history-time">${timeStr}</span>
            `;

  historyList.insertBefore(li, historyList.firstChild);

  // Giới hạn số lượng lịch sử hiển thị
  if (historyList.children.length > 10) {
    historyList.removeChild(historyList.lastChild);
  }
}

// Tạo dữ liệu vé ngẫu nhiên
function generateRandomTicketData() {
  const movies = [
    {
      name: "Avengers: Endgame",
      poster:
        "https://via.placeholder.com/400x200/1a1f2c/e50914?text=Avengers:+Endgame",
    },
    {
      name: "Dune: Part Two",
      poster:
        "https://via.placeholder.com/400x200/1a1f2c/e50914?text=Dune:+Part+Two",
    },
    {
      name: "Oppenheimer",
      poster:
        "https://via.placeholder.com/400x200/1a1f2c/e50914?text=Oppenheimer",
    },
    {
      name: "The Batman",
      poster:
        "https://via.placeholder.com/400x200/1a1f2c/e50914?text=The+Batman",
    },
    {
      name: "Inside Out 2",
      poster:
        "https://via.placeholder.com/400x200/1a1f2c/e50914?text=Inside+Out+2",
    },
  ];

  const cinemas = ["Cinema 1", "Cinema 2", "Cinema 3", "Cinema 4", "IMAX"];
  const randomMovie = movies[Math.floor(Math.random() * movies.length)];

  // Tạo mã vé ngẫu nhiên
  const ticketCode =
    "#" + Math.random().toString(36).substring(2, 8).toUpperCase();

  // Tạo ghế ngẫu nhiên
  const row = String.fromCharCode(65 + Math.floor(Math.random() * 10));
  const seat1 = Math.floor(Math.random() * 20) + 1;
  const seat2 = seat1 + 1;

  // Tạo ngày giờ ngẫu nhiên trong tương lai
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + Math.floor(Math.random() * 14)); // Ngày trong vòng 2 tuần tới

  const dateStr = `${futureDate.getDate().toString().padStart(2, "0")}/${(
    futureDate.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${futureDate.getFullYear()}`;

  // Tạo giờ chiếu ngẫu nhiên
  const hours = Math.floor(Math.random() * 12) + 10; // 10:00 - 22:00
  const minutes = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
  const timeStr = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;

  return {
    movieName: randomMovie.name,
    cinema: cinemas[Math.floor(Math.random() * cinemas.length)],
    date: dateStr,
    time: timeStr,
    seats: `${row}${seat1}, ${row}${seat2}`,
    code: ticketCode,
    posterUrl: randomMovie.poster,
  };
}

// Hiển thị hộp thoại nhập mã thủ công
function showManualInput() {
  const code = prompt("Vui lòng nhập mã vé:");
  if (code && code.trim() !== "") {
    processTicketCode(code.trim());
  }
}

// Hiệu ứng pulse cho status indicator
const statusIndicator = document.querySelector(".status-indicator");
if (statusIndicator) {
  setInterval(() => {
    statusIndicator.classList.add("pulse");
    setTimeout(() => {
      statusIndicator.classList.remove("pulse");
    }, 1500);
  }, 3000);
}

// Khởi tạo hiển thị thông tin vé
const ticketInfo = document.getElementById("ticketInfo");
if (ticketInfo) {
  ticketInfo.classList.add("active");
}

// Thêm sự kiện resize để điều chỉnh canvas
window.addEventListener("resize", function () {
  if (scanning) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
});
