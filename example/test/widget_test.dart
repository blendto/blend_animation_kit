// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'dart:io';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() async {
  TestWidgetsFlutterBinding.ensureInitialized();

  await TestWidgetsFlutterBinding.instance.runAsync(() async {
    final fontData = File('test/Roboto-Regular.ttf')
        .readAsBytes()
        .then((bytes) => ByteData.view(Uint8List.fromList(bytes).buffer));
    final fontLoader = FontLoader('Roboto')..addFont(fontData);
    await fontLoader.load();
    return true;
  });

  final GlobalKey key = GlobalKey();
  runApp(MaterialApp(
    home: Material(
      child: RepaintBoundary(
        key: key,
        child: const Text(
          "Hello World",
          style: TextStyle(
            fontSize: 30,
            color: Colors.white,
          ),
        ),
      ),
    ),
  ));
  final boundary =
      key.currentContext?.findRenderObject() as RenderRepaintBoundary?;
  final image = await boundary?.toImage();
  final byteData = await image?.toByteData(format: ImageByteFormat.png);
  image?.dispose();
  final imageBytes = byteData?.buffer.asUint8List();
  final file = await TestWidgetsFlutterBinding.instance.runAsync(() async {
    return await File('img.png').writeAsBytes(imageBytes!.toList());
  });
  markTestSkipped("Saved $file");
}
