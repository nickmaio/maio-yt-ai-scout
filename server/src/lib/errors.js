export class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class YouTubeError extends AppError {
  constructor(message, status = 502, details) {
    super(message, status, 'YOUTUBE_ERROR', details);
  }
}
