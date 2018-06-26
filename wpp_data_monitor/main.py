from wpp_data_monitor.collect_message import EngineWpp


def run():
    engine = EngineWpp()
    engine.click_group('GRUPO RESOCIE')
    package_messages = engine.get_message_from_group()
    engine.record_messages(package_messages)


if __name__ == '__main__':
    main()
