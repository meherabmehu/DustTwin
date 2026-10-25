"""Real USB UART or Wokwi TCP serial stream; no firmware execution is fabricated."""
import socket

class LineTransport:
    def __init__(self, address):
        if address.startswith('tcp://'):
            host,port=address[6:].rsplit(':',1)
            if host not in ['localhost','127.0.0.1']: raise ValueError('Only local Wokwi TCP serial is supported')
            self.stream=socket.create_connection((host,int(port)),timeout=2);self.stream.settimeout(.05);self.serial=False
        elif address.startswith('rfc2217://'):
            from urllib.parse import urlparse
            if urlparse(address).hostname not in ['localhost','127.0.0.1']:raise ValueError('Only local Wokwi RFC2217 is supported')
            import serial
            self.stream=serial.serial_for_url(address,baudrate=115200,timeout=.05,write_timeout=.5);self.serial=True
        else:
            import serial
            self.stream=serial.Serial(address,115200,timeout=.05,write_timeout=.5);self.serial=True
        self.buffer=bytearray()
    def write(self,line):
        data=line.encode('utf-8')
        if self.serial:self.stream.write(data)
        else:self.stream.sendall(data)
    def read(self):
        if b'\n' in self.buffer:
            line,_,rest=self.buffer.partition(b'\n');self.buffer=bytearray(rest);return bytes(line)
        try:data=self.stream.read(256) if self.serial else self.stream.recv(256)
        except (TimeoutError,socket.timeout):return None
        if not data:
            if not self.serial:raise ConnectionError('Serial TCP disconnected')
            return None
        self.buffer.extend(data)
        if len(self.buffer)>8192:self.buffer.clear();raise ValueError('Serial buffer overflow')
        if b'\n' not in self.buffer:return None
        line,_,rest=self.buffer.partition(b'\n');self.buffer=bytearray(rest);return bytes(line)
    def close(self):self.stream.close()
