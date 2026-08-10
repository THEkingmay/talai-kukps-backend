รถส่งแหน่งพร้อม status active ไปยัง mqtt broker
server trigger ข้อมูลใหม่ บันทึกลง redis เพื่อให้ worker อ่านและบันทึก log และบอร์ดแคสไปยัง client
โดยที่ในขั้นนี้หากสถานะใหม่กับเก่าไม่ตรงกันใน redis จะบันทึกลง db cars เพื่อแก้ไข status
สถานะไม่เหมือนกันเกิดขึ้นได้เมื่อรถไม่ได้ส่งข้อมูลไปยัง mqtt broker นานเกินเวลาที่กำหนด server จะเปลี่ยนสถานะไปเป็น inactive ทั้ง redis , db
