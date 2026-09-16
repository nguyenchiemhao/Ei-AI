// The error taxonomy of design §7.4. Every problem+json response carries one of these codes,
// and the HTTP status comes from this table rather than from the call site that raises it.
// Five are additions §7.4 does not name. NOT_FOUND and RATE_LIMITED fill gaps §7.2 relies on —
// it lists both statuses on endpoints while the taxonomy names neither. AUTH_TOKEN_EXPIRED is
// what lets a client tell "refresh" from "log in again". VALIDATION_FAILED and INTERNAL_ERROR
// are what the HTTP edge itself raises.
export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: { status: 401, title: 'Email hoặc mật khẩu không đúng' },
  AUTH_ACCOUNT_LOCKED: { status: 423, title: 'Tài khoản đã bị khoá' },
  AUTH_TOKEN_REUSE: { status: 401, title: 'Refresh token đã được dùng lại' },
  AUTH_TOKEN_EXPIRED: { status: 401, title: 'Phiên đăng nhập đã hết hạn' },
  RATE_LIMITED: { status: 429, title: 'Quá nhiều yêu cầu' },
  WORKSPACE_NAME_TAKEN: { status: 409, title: 'Tên workspace đã được dùng' },
  WORKSPACE_LAST_OWNER: { status: 409, title: 'Workspace phải còn ít nhất một Owner' },
  DOC_DUPLICATE_CONTENT: { status: 409, title: 'Nội dung này đã là một phiên bản của tài liệu' },
  AUTHZ_WORKSPACE_FORBIDDEN: { status: 403, title: 'Không phải thành viên của workspace này' },
  AUTHZ_TOOL_FORBIDDEN: { status: 403, title: 'Vai trò không được gọi tool này' },
  DOC_UNSUPPORTED_FORMAT: { status: 415, title: 'Định dạng tài liệu không được hỗ trợ' },
  DOC_TOO_LARGE: { status: 413, title: 'Tài liệu vượt quá giới hạn' },
  DOC_CONTENT_MISMATCH: { status: 415, title: 'Nội dung không khớp phần mở rộng' },
  AGENT_INVALID_ACTION: { status: 500, title: 'Agent trả về hành động sai schema' },
  MCP_WRITE_DISABLED: { status: 409, title: 'Tool ghi bị tắt ở phiên bản này' },
  MCP_PAYLOAD_INVALID: { status: 400, title: 'Payload không khớp schema của tool' },
  MCP_UNREACHABLE: { status: 503, title: 'MCP server không phản hồi' },
  APPROVAL_EXPIRED: { status: 410, title: 'Yêu cầu phê duyệt đã hết hạn' },
  APPROVAL_ALREADY_DECIDED: { status: 409, title: 'Yêu cầu phê duyệt đã được quyết định' },
  EGRESS_NOT_ALLOWLISTED: { status: 403, title: 'Đích đến không nằm trong allowlist' },
  VALIDATION_FAILED: { status: 400, title: 'Dữ liệu gửi lên không hợp lệ' },
  NOT_FOUND: { status: 404, title: 'Không tìm thấy' },
  NOT_IMPLEMENTED: { status: 501, title: 'Tính năng chưa được triển khai' },
  INTERNAL_ERROR: { status: 500, title: 'Lỗi không mong đợi' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// TURN_BUDGET_EXHAUSTED and TURN_LOOP_DETECTED are in §7.4 with status 200 and are deliberately
// absent: they are turn outcomes carried in a successful body, not failures the filter renders.
