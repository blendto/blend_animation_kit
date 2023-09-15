import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;

const fps = 24;

TextAnimationBuilder testAnimation(String text, TextStyle? textStyle) {
  return TextAnimationBuilder(CharacterAnimationInput(text: 'text'))
      .add(variant3Pipeline);
}

Future<Response> _echoRequest(Request request, WidgetTester tester) async {
  final out = await pumpAndGenerate(request.url.toString(), tester);
  return Response.ok(out, headers: {"Content-Type": "video/webm"});
}

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
  testWidgets("Some test", (tester) async {
    final server = await TestWidgetsFlutterBinding.instance.runAsync(() async {
      var handler = const Pipeline()
          .addMiddleware(logRequests())
          .addHandler((req) => _echoRequest(req, tester));
      return await shelf_io.serve(handler, 'localhost', 8080);
    });
    print("Running Server: ${server?.address.address}:${server?.port}");
    await Completer().future;
  }, timeout: Timeout.none);
}

Future<Stream<List<int>>> pumpAndGenerate(
    String text, WidgetTester tester) async {
  final testAnimationBuilder = testAnimation(
      text,
      const TextStyle(
        fontSize: 30,
        color: Colors.red,
      ));
  final GlobalKey key = GlobalKey();
  await tester.pumpWidget(MaterialApp(
    home: Material(
      child: RepaintBoundary(
        key: key,
        child: TextAnimationWidget(builder: testAnimationBuilder),
      ),
    ),
  ));

  final perFrameDuration = Duration(milliseconds: (1000 / (fps)).round());

  Duration currentDuration = Duration.zero;
  final boundary =
      key.currentContext?.findRenderObject() as RenderRepaintBoundary;

  final frames = Frames();
  while (currentDuration <= (testAnimationBuilder.tween.duration)) {
    final image = await boundary.toImage();
    frames.add(FrameItem(image: image, duration: currentDuration));
    currentDuration += perFrameDuration;
    await TestWidgetsFlutterBinding.instance.pump(perFrameDuration);
  }

  final args = <String>[
    '-f',
    'image2pipe',
    "-r",
    fps.toString(),
    "-y",
    '-i',
    'pipe:0',
    '-f',
    'webm',
    'pipe:1',
  ];
  var ffmpegProcess = await Process.start('ffmpeg', args);

  final images = await frames.waitForImages();
  for (var element in images) {
    ffmpegProcess.stdin.add(element);
  }

  await ffmpegProcess.stdin.close();

  frames.dispose();
  return ffmpegProcess.stdout;
}

class FrameItem {
  final ui.Image image;
  final Duration duration;

  late final Future<List<int>> rawImage;

  FrameItem({required this.image, required this.duration}) {
    rawImage = getRawImage();
  }

  Future<List<int>> getRawImage() async {
    // TODO: Fix Slowest call
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    return byteData!.buffer.asUint8List().toList();
  }

  void dispose() {
    image.dispose();
  }
}

class Frames {
  final List<FrameItem> frames = [];

  void add(FrameItem frameItem) {
    return frames.add(frameItem);
  }

  Stream<List<int>> imagesStream() {
    return Stream.fromFutures(frames.map((e) => e.rawImage));
  }

  Future<List<List<int>>> waitForImages() {
    return Future.wait(frames.map((e) => e.rawImage));
  }

  void dispose() {
    for (var element in frames) {
      element.dispose();
    }
  }
}
