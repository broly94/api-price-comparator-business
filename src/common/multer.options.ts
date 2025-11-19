import { HttpException, HttpStatus } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';

export const multerOptions = {
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB limit
  },
  fileFilter: (_req: any, file: any, callback: any) => {
    if (
      file.mimetype.match(
        /\/(vnd.openxmlformats-officedocument.spreadsheetml.sheet|vnd.ms-excel)$/,
      )
    ) {
      callback(null, true);
    } else {
      callback(
        new HttpException(
          `Unsupported file type ${extname(file.originalname)}`,
          HttpStatus.BAD_REQUEST,
        ),
        false,
      );
    }
  },
  storage: diskStorage({
    destination: './uploads', // Directory to save uploaded files
    filename: (_, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      callback(
        null,
        `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
      );
    },
  }),
};
