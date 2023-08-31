import 'package:custom_text_animations/custom_text_animations.dart';
import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData.dark(
        useMaterial3: true,
      ),
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  final widgets = [
    const CharacterScaleFadeTextAnimation(
      text: 'Character Scale Fade',
      textStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
    ),
    const CharacterJumpTextAnimation(
      text: 'Hello World',
      textStyle: TextStyle(fontSize: 40),
    ),
    const WordScaleTextAnimation(
      text: 'Word Scale',
      textStyle: TextStyle(fontSize: 40),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            children: [
              Expanded(
                child: ListView.separated(
                  separatorBuilder: (context, index) => const SizedBox(
                    height: 10,
                  ),
                  itemCount: widgets.length,
                  itemBuilder: (context, index) {
                    return Center(
                      child: Container(
                        decoration: BoxDecoration(
                            border: Border.all(color: Colors.red)),
                        child: widgets[index],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
