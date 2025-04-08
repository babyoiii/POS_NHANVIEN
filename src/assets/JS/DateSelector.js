
// Hàm tạo và cập nhật tiêu đề phần phim đang chiếu
function createMovieSectionTitle() {
    // Tìm container chứa tiêu đề phần phim đang chiếu
    const sectionContainer = document.querySelector('.movie-section') || document.querySelector('.main-content');
    if (!sectionContainer) return;

    // Kiểm tra xem đã có section-title chưa
    let sectionTitle = sectionContainer.querySelector('.section-title');

    // Nếu chưa có, tạo mới
    if (!sectionTitle) {
        sectionTitle = document.createElement('div');
        sectionTitle.className = 'section-title';

        // Thêm vào đầu container
        sectionContainer.prepend(sectionTitle);
    }

    // Xóa nội dung cũ (nếu có)
    sectionTitle.innerHTML = '';

    // Tạo tiêu đề chính
    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Phim đang chiếu';

    // Tạo phần hiển thị ngày
    const dateInfoSpan = document.createElement('span');
    dateInfoSpan.className = 'date-info';

    // Lấy ngày hiện tại
    const today = new Date();
    const utc = today.getTime() + (today.getTimezoneOffset() * 60000);
    const vietnamTime = new Date(utc + (3600000 * 7));

    const day = vietnamTime.getDate().toString().padStart(2, '0');
    const month = (vietnamTime.getMonth() + 1).toString().padStart(2, '0');
    const year = vietnamTime.getFullYear();

    const weekdayNames = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
    const weekday = weekdayNames[vietnamTime.getDay()];

    dateInfoSpan.textContent = `Ngày ${day}/${month}/${year} (${weekday})`;

    // Thêm vào section-title
    sectionTitle.appendChild(titleSpan);
    sectionTitle.appendChild(dateInfoSpan);

    return dateInfoSpan; // Trả về phần tử hiển thị ngày để có thể cập nhật sau này
}

// Sửa hàm generateDateSelector để cập nhật tiêu đề khi chọn ngày
function generateDateSelector() {
    const dateSelector = document.querySelector('.date-selector');
    if (!dateSelector) return; // Đảm bảo phần tử tồn tại

    dateSelector.innerHTML = ''; // Xóa tất cả các ngày hiện tại

    const today = new Date();
    // Chuyển đổi sang múi giờ GMT+7
    const utc = today.getTime() + (today.getTimezoneOffset() * 60000);
    const vietnamTime = new Date(utc + (3600000 * 7));

    // Đảm bảo section title đã được tạo
    let dateInfo = document.querySelector('.date-info');
    if (!dateInfo) {
        dateInfo = createMovieSectionTitle();
    }

    // Tạo 7 ngày từ ngày hiện tại
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(vietnamTime);
        currentDate.setDate(vietnamTime.getDate() + i);

        const day = currentDate.getDate().toString().padStart(2, '0');
        const month = currentDate.getMonth() + 1; // Tháng bắt đầu từ 0

        // Xác định ngày trong tuần
        const weekdayNames = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
        const weekday = weekdayNames[currentDate.getDay()];

        // Tạo phần tử ngày
        const dateItem = document.createElement('div');
        dateItem.className = 'date-item';
        if (i === 0) {
            dateItem.classList.add('active'); // Ngày đầu tiên (hôm nay) sẽ được chọn
        }

        dateItem.innerHTML = `
            <div class="month">Tháng ${month}</div>
            <div class="day">${day}</div>
            <div class="weekday">${i === 0 ? 'Hôm nay' : weekday}</div>
        `;

        // Thêm sự kiện click
        dateItem.addEventListener('click', function () {
            // Xóa class active từ tất cả các ngày
            document.querySelectorAll('.date-item').forEach(item => {
                item.classList.remove('active');
            });
            // Thêm class active cho ngày được chọn
            this.classList.add('active');

            // Cập nhật tiêu đề phần phim đang chiếu
            const dateInfo = document.querySelector('.date-info');
            if (dateInfo) {
                const selectedDay = this.querySelector('.day').textContent;
                const selectedMonth = this.querySelector('.month').textContent.replace('Tháng ', '');
                const selectedWeekday = this.querySelector('.weekday').textContent === 'Hôm nay' ?
                    weekdayNames[vietnamTime.getDay()] : this.querySelector('.weekday').textContent;

                dateInfo.textContent = `Ngày ${selectedDay}/${selectedMonth}/2025 (${selectedWeekday})`;
            }
        });

        dateSelector.appendChild(dateItem);
    }
}

// Khởi tạo bộ chọn ngày khi trang được tải
document.addEventListener('DOMContentLoaded', function () {
    // Tạo tiêu đề phần phim đang chiếu
    createMovieSectionTitle();

    // Tạo bộ chọn ngày động
    generateDateSelector();

    // Thiết lập kiểm tra định kỳ để cập nhật bộ chọn ngày khi cần
    setInterval(checkAndUpdateDateSelector, 60000); // Kiểm tra mỗi phút
});

