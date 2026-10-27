// 通过当前站点同源代理连接后端 WebSocket，避免写死 localhost（换机器/局域网/部署后都能用）
const SPRING_WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/ws/message`;

class SpringWebSocketService {
  private ws: WebSocket | null = null;
  private connected = false;
  private connecting = false;
  private reconnectTimer: any = null;
  private listeners: Set<Function> = new Set();

  connect(userId: string) {
    if (!userId) return;
    if (this.connected) return;
    if (this.connecting) return;

    this.connecting = true;
    try {
      this.ws = new WebSocket(SPRING_WS_URL);

      this.ws.onopen = () => {
        console.log('Spring Boot WebSocket连接成功');
        this.connected = true;
        this.connecting = false;
        this.ws?.send(`register:${userId}`);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'new_message') {
            this.listeners.forEach((cb) => {
              try { cb(message); } catch (e) { console.error(e); }
            });
          }
        } catch (e) {
          console.error('解析WebSocket消息失败:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('Spring Boot WebSocket连接关闭');
        this.connected = false;
        this.connecting = false;
        this.scheduleReconnect(userId);
      };

      this.ws.onerror = (err) => {
        console.error('Spring Boot WebSocket错误:', err);
        this.connected = false;
        this.connecting = false;
        this.ws?.close();
      };
    } catch (e) {
      console.error('创建WebSocket连接失败:', e);
      this.connecting = false;
      this.scheduleReconnect(userId);
    }
  }

  private scheduleReconnect(userId: string) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.connected) {
        this.connect(userId);
      }
    }, 3000);
  }

  onMessage(callback: Function) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.listeners.clear();
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.connecting = false;
  }
}

export const springWsService = new SpringWebSocketService();
