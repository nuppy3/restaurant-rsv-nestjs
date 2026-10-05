import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiPage() {
  return (
    <div style={{ height: '100vh' }}>
      <SwaggerUI url="/nestjs-fleamarket/swagger.json" />
    </div>
  );
}
