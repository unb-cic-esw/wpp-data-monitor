#/usr/bin/env python
from setuptools import setup, find_packages
import io
import re


with io.open('./wpp_data_monitor/__init__.py', encoding='utf8') as version_file:
    version_match = re.search(r"^__version__ = ['\"]([^'\"]*)['\"]",
                              version_file.read(), re.M)
    if version_match:
        version = version_match.group(1)
    else:
        raise RuntimeError("Unable to find version string.")


with io.open('README.md', encoding='utf8') as readme:
    long_description = readme.read()


setup(
    name='wpp-data-monitor',
    version=version,
    description='Whatsapp Data Monitor.',
    long_description=long_description,
    author='Dayanne Fernandes',
    author_email='dayannefernandesc@gmail.com',
    packages=find_packages(exclude='tests'),
    install_requires=['bs4', 'selenium'],
    scripts=[],
    entry_points={
        'console_scripts': [
            'wpp = wpp_data_monitor.__main__:start'
        ]
    },
    classifiers=[
        'Programming Language :: Python :: 3.6',
    ],
    test_suite='tests'
)
