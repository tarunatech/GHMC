import bcrypt from 'bcryptjs';

const hash = '$2a$10$QUkdnTjct2fQRXBoThYc9OhA5mxdCC.wYj6A.iWSuwtd7DYYrbO12';
const password = 'admin123';

bcrypt.compare(password, hash).then(res => {
    console.log(`Password 'admin123' check: ${res}`);
}).catch(console.error);
