import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const testData = new SharedArray("test", function () {
  return [JSON.parse(open("./test-data.json"))];
});

export default function () {
  console.log("Students: " + testData[0].students.length);
  sleep(1);
}
