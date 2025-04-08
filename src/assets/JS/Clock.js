
// Hàm cập nhật đồng hồ
function updateClock() {
    const now = new Date();

    // Chuyển đổi sang múi giờ GMT+7
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const vietnamTime = new Date(utc + (3600000 * 7));

    const hours = vietnamTime.getHours().toString().padStart(2, '0');
    const minutes = vietnamTime.getMinutes().toString().padStart(2, '0');
    const seconds = vietnamTime.getSeconds().toString().padStart(2, '0');

    const day = vietnamTime.getDate().toString().padStart(2, '0');
    const month = (vietnamTime.getMonth() + 1).toString().padStart(2, '0');
    const year = vietnamTime.getFullYear();

    const prevDate = document.getElementById('date').textContent;
    const currentDate = `${day}/${month}/${year}`;

    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
    document.getElementById('date').textContent = currentDate;

    // Kiểm tra nếu ngày đã thay đổi và bộ chọn ngày đã được khởi tạo
    if (prevDate !== currentDate && prevDate !== '00/00/0000' && typeof generateDateSelector === 'function') {
        generateDateSelector();
    }

    setTimeout(updateClock, 1000);
}

// Khởi tạo đồng hồ khi trang được tải
document.addEventListener('DOMContentLoaded', function () {
    // Tìm sidebar
    const sidebar = document.querySelector('.sidebar');

    // Tạo phần tử đồng hồ
    const clockContainer = document.createElement('div');
    clockContainer.className = 'clock-container';

    const clockElement = document.createElement('div');
    clockElement.id = 'clock';
    clockElement.className = 'clock';
    clockElement.textContent = '00:00:00';

    const dateElement = document.createElement('div');
    dateElement.id = 'date';
    dateElement.className = 'date';
    dateElement.textContent = '00/00/0000';

    // Thêm vào container
    clockContainer.appendChild(clockElement);
    clockContainer.appendChild(dateElement);

    // Thêm vào sidebar
    sidebar.appendChild(clockContainer);

    // Bắt đầu cập nhật đồng hồ
    updateClock();
});


