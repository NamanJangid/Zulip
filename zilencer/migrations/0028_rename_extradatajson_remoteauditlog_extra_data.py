# Generated by Django 4.0.7 on 2022-10-02 17:02

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("zilencer", "0027_backfill_remote_realmauditlog_extradata_to_json_field"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="remoterealmauditlog",
            name="extra_data",
        ),
        migrations.RemoveField(
            model_name="remotezulipserverauditlog",
            name="extra_data",
        ),
        migrations.RenameField(
            model_name="remoterealmauditlog",
            old_name="extra_data_json",
            new_name="extra_data",
        ),
        migrations.RenameField(
            model_name="remotezulipserverauditlog",
            old_name="extra_data_json",
            new_name="extra_data",
        ),
    ]
