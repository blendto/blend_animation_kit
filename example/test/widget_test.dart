// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'dart:io';
import 'dart:ui';

import 'package:custom_text_animations/custom_text_animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

const fps = 24;
const paddingLength = 5;

TextAnimationBuilder testAnimation(String text, TextStyle? textStyle) =>
    TextAnimationBuilder(
            CharacterAnimationInput(text: text, textStyle: textStyle))
        .opacityAndTransform(
          initialOpacity: 1.0,
          initialMatrix: Matrix4.identity()..scale(0.001),
          finalOpacity: 1.0,
          finalMatrix: Matrix4.identity(),
          transformAlignment: Alignment.bottomLeft,
          speed: const Duration(milliseconds: 1500),
          stepInterval: const Duration(milliseconds: 45),
          curve: Curves.elasticOut,
        )
        .waitAndFadeOutAll();

void main() async {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets("Some  test", (tester) async {
    await TestWidgetsFlutterBinding.instance.runAsync(() async {
      final fontData = File('test/Roboto-Regular.ttf')
          .readAsBytes()
          .then((bytes) => ByteData.view(Uint8List.fromList(bytes).buffer));
      final fontLoader = FontLoader('Roboto')..addFont(fontData);
      await fontLoader.load();
      return true;
    });

    final stop = Stopwatch()..start();
    final testAnimationBuilder = testAnimation(
        "Hello World",
        const TextStyle(
          fontSize: 30,
          color: Colors.red,
        ));
    final GlobalKey key = GlobalKey();
    await tester.pumpWidget(MaterialApp(
      home: Material(
        child: RepaintBoundary(
          key: key,
          child: testAnimationBuilder.generateWidget(),
        ),
      ),
    ));

    int index = 0;
    final perFrameDuration = Duration(milliseconds: (1000 / (fps)).round());

    Duration currentDuration = Duration.zero;
    List<FrameItem> frames = [];
    await TestWidgetsFlutterBinding.instance.runAsync(() async {
      while (currentDuration <= testAnimationBuilder.tween.duration) {
        final boundary =
            key.currentContext?.findRenderObject() as RenderRepaintBoundary?;
        final image = await boundary?.toImage();
        final byteData = await image?.toByteData(format: ImageByteFormat.png);
        image?.dispose();
        frames
            .add(FrameItem(imageBuffer: byteData!, duration: currentDuration));
        await File(
                "./captures/img-${index.toString().padLeft(paddingLength, '0')}.png")
            .writeAsBytes(byteData.buffer.asUint8List().toList());
        currentDuration += perFrameDuration;
        index += 1;
        await TestWidgetsFlutterBinding.instance.pump(perFrameDuration);
      }
    });

    print(stop.elapsedMilliseconds);
    final args = <String>[
      "-r",
      fps.toString(),
      "-y",
      "-i",
      "./captures/img-%0${paddingLength}d.png",
      "./captures/output.webm"
    ];
    await TestWidgetsFlutterBinding.instance.runAsync(() async {
      var result = await Process.run('ffmpeg', args);
      print(result.stderr);
      print(result.stdout);
    });
    print(stop.elapsedMilliseconds);
  });
}

class FrameItem {
  final ByteData imageBuffer;
  final Duration duration;

  const FrameItem({required this.imageBuffer, required this.duration});
}
