# AI interviewer spike — findings

| Ngày | Phiên bản | Phụ trách | Trạng thái |
| --- | --- | --- | --- |
| 31/10/2026 | 0.2 | Lâm Gia Hưng | Đã có mã và bằng chứng chạy thử; chờ Nhân review |

## Findings

Chúng tôi đã xây dựng prompt và hợp đồng JSON gồm `follow_up`, `next_topic`, `end`, dùng tên hành động khớp database. Quy tắc hỏi sâu tham khảo PolyInterview; STAR áp dụng cho vòng behavioral. Backend giới hạn lượt hỏi sâu và tự kết thúc khi hết giờ hoặc hết câu chính.

Prompt 0.2 chạy bằng `gemini-3.5-flash-lite` trên ba JD giả lập Việt/Anh, mỗi JD có câu trả lời tốt, mơ hồ và lạc đề, cùng năm ca biên. Một lần chạy cho 14/14 đầu ra hợp lệ và hành động thuộc kỳ vọng: 12 lượt gọi Gemini, hai lượt end do backend xử lý. Ba câu trả lời tốt chuyển chủ đề; ba câu mơ hồ được hỏi sâu. Đây không phải tỷ lệ chính xác tổng quát.

Prompt 0.1 có reason sai ngôn ngữ và nguy cơ giả định kinh nghiệm. Chúng tôi sửa chỉ dẫn trong 0.2; kiểm tra bằng AI trên lần chạy mới ghi nhận ngôn ngữ đúng cấu hình. Còn câu hỏi rộng hoặc hỏi lại kỹ năng dưới góc khác; validator chưa chặn trùng nghĩa. Chưa có kiểm thử người dùng hoặc chấm độc lập của Nhân.

Model gọi được và có free tier theo tài liệu Google; billing tier và quota project chưa xác nhận. Nhân cần review và chốt lưu decision vì feedbacks bắt buộc điểm số; không điền điểm giả. Endpoint tuần 5 còn cần auth, chống trùng lượt và scoring. Review, thông báo Slack và cập nhật Jira chưa thực hiện.

## Bằng chứng và cách tái lập

- [Hợp đồng và hướng dẫn chạy](../api/AI_INTERVIEWER_CONTRACT_v0.1.md).
- [Ma trận live prompt 0.1](../test/results/ai-interviewer-spike-live-v0.1.json).
- [Ma trận live prompt 0.2](../test/results/ai-interviewer-spike-live-v0.2.json).
- [Kết quả kiểm thử mã: 116/116](../test/results/ai-interviewer-unit.tap), gồm 23 test mới của module interviewer. TypeScript và ESLint trên các file mới đều đạt.
- 12 lượt Gemini của ma trận 0.2 mất 996–1.901 ms, trung vị 1.243,5 ms; đây là thời gian một request trong script ở lần chạy này, không phải độ trễ giọng nói hoặc SLO hệ thống.
- Fixtures: `src/lib/interview/interviewer-fixtures.mjs`; tất cả dữ liệu do AI tạo, không phải CV hoặc kết quả làm bài của thành viên.
- Mã: `src/lib/interview/interviewer-contract.mjs`, `interviewer-prompt.mjs`, `interviewer-provider.mjs` và `src/scripts/interviewer-spike.mjs`.
- Mã kiểm thử: `src/tests/interviewer.test.mjs`; các test dùng transport giả kiểm tra hợp đồng và lỗi, không giả nhận đó là Gemini live.

Nguồn và phần đã vận dụng được liệt kê trong mục 8 của hợp đồng. Nguồn chính: [PolyInterview, Appendix C–D](https://arxiv.org/abs/2607.10310), [Siswanto et al., STAR/BEI](https://doi.org/10.14716/ijtech.v13i2.5018), [Gomez et al., nhịp hội thoại](https://arxiv.org/abs/2506.16542). Chúng tôi không dùng các số liệu của bài báo làm kết quả thực nghiệm của InterviewBuddy.

## Lịch sử thay đổi

| Ngày | Phiên bản | Thay đổi |
| --- | --- | --- |
| 31/10/2026 | 0.1 | Prompt, contract và ma trận thử nghiệm đầu tiên |
| 31/10/2026 | 0.2 | Sửa chỉ dẫn ngôn ngữ và giả định kinh nghiệm; ghi nhận kết quả live và các giới hạn tích hợp |
