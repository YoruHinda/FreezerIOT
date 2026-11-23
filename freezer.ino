#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

const char* WIFI_SSID     = "SEU_WIFI";
const char* WIFI_PASSWORD = "SUA_SENHA";

const char* THINGSPEAK_WRITE_KEY = "SUA_WRITE_API_KEY";
const char* THINGSPEAK_URL       = "http://api.thingspeak.com/update";

const int PINO_SENSOR = 4;

const unsigned long INTERVALO_ENVIO_MS = 20000;

OneWire oneWire(PINO_SENSOR);
DallasTemperature sensor(&oneWire);

unsigned long ultimoEnvio = 0;

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Conectando ao Wi-Fi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\nConectado! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFalha ao conectar. Tentando novamente depois...");
  }
}

float lerTemperatura() {
  sensor.requestTemperatures();
  float t = sensor.getTempCByIndex(0);
  if (t == DEVICE_DISCONNECTED_C || t < -55 || t > 125) {
    return NAN;  // leitura inválida
  }
  return t;
}

bool enviarThingSpeak(float temperatura) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(THINGSPEAK_URL) +
               "?api_key=" + THINGSPEAK_WRITE_KEY +
               "&field1=" + String(temperatura, 2);

  http.begin(url);
  http.setTimeout(8000);
  int codigo = http.GET();
  String resposta = http.getString();   // ThingSpeak devolve o nº da entrada (0 = falha)
  http.end();

  Serial.printf("HTTP %d | entrada: %s\n", codigo, resposta.c_str());
  return (codigo == 200 && resposta != "0");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Freezer Inteligente ===");

  sensor.begin();
  Serial.printf("Sensores DS18B20 encontrados: %d\n", sensor.getDeviceCount());

  conectarWiFi();
}

void loop() {
  conectarWiFi();  // reconecta sozinho se cair

  if (millis() - ultimoEnvio >= INTERVALO_ENVIO_MS) {
    ultimoEnvio = millis();

    float temp = lerTemperatura();
    if (isnan(temp)) {
      Serial.println("Erro: sensor DS18B20 não respondeu. Confira a fiação e o resistor de 4,7k.");
      return;
    }

    Serial.printf("Temperatura: %.2f °C\n", temp);
    if (!enviarThingSpeak(temp)) {
      Serial.println("Falha no envio ao ThingSpeak.");
    }
  }
}