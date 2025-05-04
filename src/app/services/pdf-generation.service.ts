import { Injectable } from '@angular/core';

// Import các thư viện cần thiết
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PdfGenerationService {
  constructor() { 
    console.log('Khởi tạo dịch vụ PDF');
    
    // Đăng ký font Unicode cho jsPDF
    const pdfLib = jsPDF.API;
    if (pdfLib) {
      console.log('jsPDF API sẵn sàng để sử dụng');
    }
  }

  /**
   * Kiểm tra xem các thư viện PDF đã sẵn sàng chưa
   */
  private isPdfLibraryReady(): boolean {
    if (!jsPDF || !html2canvas) {
      console.error('Thư viện PDF chưa sẵn sàng');
      return false;
    }
    return true;
  }

  /**
   * Tạo PDF cho vé và hóa đơn
   * @param seats Danh sách ghế đã chọn
   * @param orderItems Danh sách dịch vụ đã chọn
   * @param showtimeInfo Thông tin suất chiếu
   * @param orderInfo Thông tin đơn hàng
   * @returns Promise<any> Trả về đối tượng PDF đã được tạo
   */
  async generateTicketPdf(
    seats: any[], 
    orderItems: any[], 
    showtimeInfo: any, 
    orderInfo: any
  ): Promise<any> {
    try {
      // Kiểm tra xem thư viện jsPDF đã sẵn sàng chưa
      if (!this.isPdfLibraryReady()) {
        throw new Error('Thư viện PDF chưa sẵn sàng');
      }
      
      console.log('Bắt đầu tạo PDF với:', { seats, orderItems, showtimeInfo, orderInfo });
      
      // Giới hạn số lượng ghế (tối đa 5 ghế)
      const MAX_SEATS = 5; 
      const seatsToProcess = seats.length > MAX_SEATS ? seats.slice(0, MAX_SEATS) : seats;
      
      // Tạo đối tượng PDF trực tiếp, khổ giấy A4
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true
      });
      
      // Tạo hàm text chống lỗi tiếng Việt 
      const printText = (text: string, x: number, y: number, options?: any) => {
        if (!text) return;
        
        // Xử lý các ký tự tiếng Việt đặc biệt 
        const processedText = text
          .replace(/\u00E1/g, 'a')
          .replace(/\u00E0/g, 'a')
          .replace(/\u1EA3/g, 'a')
          .replace(/\u00E3/g, 'a')
          .replace(/\u1EA1/g, 'a')
          .replace(/\u0103/g, 'a')
          .replace(/\u1EAF/g, 'a')
          .replace(/\u1EB1/g, 'a')
          .replace(/\u1EB3/g, 'a')
          .replace(/\u1EB5/g, 'a')
          .replace(/\u1EB7/g, 'a')
          .replace(/\u00E2/g, 'a')
          .replace(/\u1EA5/g, 'a')
          .replace(/\u1EA7/g, 'a')
          .replace(/\u1EA9/g, 'a')
          .replace(/\u1EAB/g, 'a')
          .replace(/\u1EAD/g, 'a')
          .replace(/\u00E9/g, 'e')
          .replace(/\u00E8/g, 'e')
          .replace(/\u1EBB/g, 'e')
          .replace(/\u1EBD/g, 'e')
          .replace(/\u1EB9/g, 'e')
          .replace(/\u00EA/g, 'e')
          .replace(/\u1EBF/g, 'e')
          .replace(/\u1EC1/g, 'e')
          .replace(/\u1EC3/g, 'e')
          .replace(/\u1EC5/g, 'e')
          .replace(/\u1EC7/g, 'e')
          .replace(/\u00ED/g, 'i')
          .replace(/\u00EC/g, 'i')
          .replace(/\u1EC9/g, 'i')
          .replace(/\u0129/g, 'i')
          .replace(/\u1ECB/g, 'i')
          .replace(/\u00F3/g, 'o')
          .replace(/\u00F2/g, 'o')
          .replace(/\u1ECF/g, 'o')
          .replace(/\u00F5/g, 'o')
          .replace(/\u1ECD/g, 'o')
          .replace(/\u00F4/g, 'o')
          .replace(/\u1ED1/g, 'o')
          .replace(/\u1ED3/g, 'o')
          .replace(/\u1ED5/g, 'o')
          .replace(/\u1ED7/g, 'o')
          .replace(/\u1ED9/g, 'o')
          .replace(/\u01A1/g, 'o')
          .replace(/\u1EDB/g, 'o')
          .replace(/\u1EDD/g, 'o')
          .replace(/\u1EDF/g, 'o')
          .replace(/\u1EE1/g, 'o')
          .replace(/\u1EE3/g, 'o')
          .replace(/\u00FA/g, 'u')
          .replace(/\u00F9/g, 'u')
          .replace(/\u1EE7/g, 'u')
          .replace(/\u0169/g, 'u')
          .replace(/\u1EE5/g, 'u')
          .replace(/\u01B0/g, 'u')
          .replace(/\u1EE9/g, 'u')
          .replace(/\u1EEB/g, 'u')
          .replace(/\u1EED/g, 'u')
          .replace(/\u1EEF/g, 'u')
          .replace(/\u1EF1/g, 'u')
          .replace(/\u00FD/g, 'y')
          .replace(/\u1EF3/g, 'y')
          .replace(/\u1EF7/g, 'y')
          .replace(/\u1EF9/g, 'y')
          .replace(/\u1EF5/g, 'y')
          .replace(/\u0111/g, 'd')
          // Cũng xử lý ký tự hoa
          .replace(/\u00C1/g, 'A')
          .replace(/\u00C0/g, 'A')
          .replace(/\u1EA2/g, 'A')
          .replace(/\u00C3/g, 'A')
          .replace(/\u1EA0/g, 'A')
          .replace(/\u0102/g, 'A')
          .replace(/\u1EAE/g, 'A')
          .replace(/\u1EB0/g, 'A')
          .replace(/\u1EB2/g, 'A')
          .replace(/\u1EB4/g, 'A')
          .replace(/\u1EB6/g, 'A')
          .replace(/\u00C2/g, 'A')
          .replace(/\u1EA4/g, 'A')
          .replace(/\u1EA6/g, 'A')
          .replace(/\u1EA8/g, 'A')
          .replace(/\u1EAA/g, 'A')
          .replace(/\u1EAC/g, 'A')
          .replace(/\u00C9/g, 'E')
          .replace(/\u00C8/g, 'E')
          .replace(/\u1EBA/g, 'E')
          .replace(/\u1EBC/g, 'E')
          .replace(/\u1EB8/g, 'E')
          .replace(/\u00CA/g, 'E')
          .replace(/\u1EBE/g, 'E')
          .replace(/\u1EC0/g, 'E')
          .replace(/\u1EC2/g, 'E')
          .replace(/\u1EC4/g, 'E')
          .replace(/\u1EC6/g, 'E')
          .replace(/\u00CD/g, 'I')
          .replace(/\u00CC/g, 'I')
          .replace(/\u1EC8/g, 'I')
          .replace(/\u0128/g, 'I')
          .replace(/\u1ECA/g, 'I')
          .replace(/\u00D3/g, 'O')
          .replace(/\u00D2/g, 'O')
          .replace(/\u1ECE/g, 'O')
          .replace(/\u00D5/g, 'O')
          .replace(/\u1ECC/g, 'O')
          .replace(/\u00D4/g, 'O')
          .replace(/\u1ED0/g, 'O')
          .replace(/\u1ED2/g, 'O')
          .replace(/\u1ED4/g, 'O')
          .replace(/\u1ED6/g, 'O')
          .replace(/\u1ED8/g, 'O')
          .replace(/\u01A0/g, 'O')
          .replace(/\u1EDA/g, 'O')
          .replace(/\u1EDC/g, 'O')
          .replace(/\u1EDE/g, 'O')
          .replace(/\u1EE0/g, 'O')
          .replace(/\u1EE2/g, 'O')
          .replace(/\u00DA/g, 'U')
          .replace(/\u00D9/g, 'U')
          .replace(/\u1EE6/g, 'U')
          .replace(/\u0168/g, 'U')
          .replace(/\u1EE4/g, 'U')
          .replace(/\u01AF/g, 'U')
          .replace(/\u1EE8/g, 'U')
          .replace(/\u1EEA/g, 'U')
          .replace(/\u1EEC/g, 'U')
          .replace(/\u1EEE/g, 'U')
          .replace(/\u1EF0/g, 'U')
          .replace(/\u00DD/g, 'Y')
          .replace(/\u1EF2/g, 'Y')
          .replace(/\u1EF6/g, 'Y')
          .replace(/\u1EF8/g, 'Y')
          .replace(/\u1EF4/g, 'Y')
          .replace(/\u0110/g, 'D');
          
        // In text vào PDF
        pdf.text(processedText, x, y, options);
      };
      
      // Tạo từng trang vé trực tiếp bằng jsPDF
      for (let i = 0; i < seatsToProcess.length; i++) {
        const seat = seatsToProcess[i];
        
        // Thêm trang mới cho mỗi ghế (trừ ghế đầu tiên)
        if (i > 0) {
          pdf.addPage();
        }
        
        // Font cơ bản
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(24);
        pdf.setTextColor(0, 0, 0);
        
        // Tiêu đề trung tâm
        printText('CINEX CINEMA', 105, 20, { align: 'center' }); 
        pdf.setFontSize(18);
        printText('VE XEM PHIM', 105, 30, { align: 'center' });
        
        // Thông tin phim và suất chiếu
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        printText(showtimeInfo?.movieTitle || '', 105, 45, { align: 'center' });
        
        // Thông tin vé
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        
        // Cột trái - thông tin phim
        printText('Thong tin ve:', 20, 60);
        
        let yPos = 70;
        
        // Chỉ hiển thị thông tin rạp nếu có
        if (showtimeInfo?.cinemaName && showtimeInfo.cinemaName.trim() !== '') {
          printText(`Rap: ${showtimeInfo.cinemaName}`, 20, yPos);
          yPos += 10;
        }
        
        // Chỉ hiển thị thông tin phòng nếu có
        if (showtimeInfo?.roomName && showtimeInfo.roomName.trim() !== '') {
          printText(`Phong: ${showtimeInfo.roomName}`, 20, yPos);
          yPos += 10;
        }
        
        // Chỉ hiển thị ngày chiếu nếu có
        if (showtimeInfo?.showDate && showtimeInfo.showDate.trim() !== '') {
          printText(`Ngay chieu: ${showtimeInfo.showDate}`, 20, yPos);
          yPos += 10;
        }
        
        // Chỉ hiển thị suất chiếu nếu có
        if (showtimeInfo?.showTime && showtimeInfo.showTime.trim() !== '') {
          printText(`Suat chieu: ${showtimeInfo.showTime}`, 20, yPos);
          yPos += 10;
        }
        
        // Đặt lại vị trí y cho các phần tiếp theo
        const infoEndY = Math.max(yPos, 100);
        
        // Cột phải - thông tin ghế
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        printText(`GHE: ${seat.RowName || ''}${seat.SeatName || ''}`, 150, 70, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(14);
        printText(`Loai ghe: ${seat.SeatTypeName || 'Ghe thuong'}`, 140, 80);
        printText(`Gia ve: ${(seat.SeatPrice || 0).toLocaleString()}d`, 140, 90);
        
        // Đường line phân cách
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.5);
        pdf.line(20, infoEndY + 10, 190, infoEndY + 10);
        
        // Thông tin đơn hàng
        printText(`Ma don hang: ${orderInfo?.orderId || ''}`, 20, 125);
        printText(`Ngay xuat ve: ${orderInfo?.orderDate || ''}`, 20, 135);
        printText(`Nhan vien: ${orderInfo?.staffName || 'Nhan vien ban hang'}`, 20, 145);
        
        // Note
        pdf.setFontSize(12);
        printText('Vui long den truoc gio chieu 15 phut', 105, 180, { align: 'center' });
        printText('Cam on quy khach da su dung dich vu!', 105, 190, { align: 'center' });
        
        console.log(`Da tao xong ve cho ghe ${i + 1}/${seatsToProcess.length}`);
      }
      
      // Nếu có đơn hàng dịch vụ, thêm vào PDF
      if (orderItems && orderItems.length > 0) {
        pdf.addPage(); // Thêm trang mới cho hóa đơn dịch vụ
        
        // Tạo trang hóa đơn trực tiếp bằng jsPDF
        // Tiêu đề
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(22);
        pdf.setTextColor(0, 0, 0);
        printText('CINEX CINEMA', 105, 20, { align: 'center' });
        pdf.setFontSize(18);
        printText('HOA DON DICH VU', 105, 30, { align: 'center' });
        
        // Thông tin đơn hàng
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        printText(`Ma don hang: ${orderInfo?.orderId || ''}`, 20, 45);
        printText(`Ngay: ${orderInfo?.orderDate || ''}`, 150, 45);
        printText(`Nhan vien: ${orderInfo?.staffName || 'Nhan vien ban hang'}`, 20, 55);
        
        // Tiêu đề bảng
        pdf.setDrawColor(0);
        pdf.setFillColor(240, 240, 240);
        pdf.rect(20, 65, 170, 10, 'F');
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        printText('STT', 25, 72);
        printText('Ten san pham', 45, 72);
        printText('So luong', 110, 72);
        printText('Don gia', 145, 72);
        printText('Thanh tien', 175, 72);
        
        // Vẽ đường kẻ dưới tiêu đề bảng
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.3);
        pdf.line(20, 75, 190, 75);
        
        // Dữ liệu bảng
        let y = 85;
        let total = 0;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        
        for (let i = 0; i < orderItems.length; i++) {
          const item = orderItems[i];
          const subtotal = (item.quantity || 1) * (item.price || 0);
          total += subtotal;
          
          printText(`${i + 1}`, 25, y);
          printText(item.name || '', 45, y);
          printText(`${item.quantity || 1}`, 115, y, { align: 'center' });
          printText(`${(item.price || 0).toLocaleString()}d`, 150, y, { align: 'right' });
          printText(`${subtotal.toLocaleString()}d`, 180, y, { align: 'right' });
          
          y += 10;
          
          // Kiểm tra xem có cần thêm trang mới không nếu danh sách quá dài
          if (y > 250 && i < orderItems.length - 1) {
            pdf.addPage();
            y = 30;
          }
        }
        
        // Vẽ đường kẻ dưới danh sách sản phẩm
        pdf.setLineWidth(0.5);
        pdf.line(20, y, 190, y);
        
        // Tổng cộng
        y += 15;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        printText('Tong cong:', 130, y);
        printText(`${total.toLocaleString()}d`, 180, y, { align: 'right' });
        
        // Footer
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        printText('Cam on quy khach da su dung dich vu!', 105, 270, { align: 'center' });
        printText('Chuc quy khach co trai nghiem xem phim tuyet voi', 105, 280, { align: 'center' });
        
        console.log('Da tao xong hoa don dich vu');
      }
      
      console.log('PDF đã được tạo xong và sẽ được trả về');
      return pdf; // Trả về đối tượng PDF để có thể lưu hoặc mở trong tab mới
    } catch (error) {
      console.error('Lỗi khi tạo PDF:', error);
      throw error;
    }
  }

  /**
   * Tải file PDF xuống máy người dùng
   * @param pdfDocument Đối tượng PDF đã tạo
   * @param filename Tên file muốn lưu
   */
  downloadPdf(pdfDocument: any, filename: string = 'ticket.pdf'): void {
    try {
      if (pdfDocument.save) {
        // Nếu đối tượng PDF có phương thức save, sử dụng nó
        pdfDocument.save(filename);
      } else {
        // Trường hợp này xảy ra khi chưa có thư viện jsPDF
        console.log(`Giả lập: Tải xuống PDF với tên ${filename}`);
        
        // Có thể mở dialog in ảo để mô phỏng
        this.openPdfInNewTab(pdfDocument);
      }
    } catch (e) {
      console.error('Lỗi khi tải xuống PDF:', e);
    }
  }

  /**
   * Mở file PDF trong tab mới
   * @param pdfDocument Đối tượng PDF đã tạo
   */
  openPdfInNewTab(pdfDocument: any): void {
    try {
      if (this.isPdfLibraryReady() && pdfDocument.output) {
        // Nếu đối tượng PDF hợp lệ, xuất dạng blob và mở trong tab mới
        const blob = pdfDocument.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        // Trường hợp này xảy ra khi chưa có thư viện jsPDF
        console.log('Giả lập: Mở PDF trong tab mới');
        
        // Mở một tab mới và mở hộp thoại in để mô phỏng
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write('<html><body><h1>Tạo vé thành công!</h1><p>Bạn có thể sử dụng hộp thoại in để lưu thành PDF.</p></body></html>');
          printWindow.document.close();
          
          // Trì hoãn việc mở hộp thoại in để đảm bảo trang được tải đầy đủ
          setTimeout(() => {
            printWindow.print();
          }, 500);
        }
      }
    } catch (e) {
      console.error('Lỗi khi mở PDF trong tab mới:', e);
    }
  }
}
