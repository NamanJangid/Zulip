# Generated by Django 4.2 on 2023-05-05 00:18

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("zerver", "0447_attachment_scheduled_messages_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="scheduledmessage",
            name="failed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="scheduledmessage",
            name="failure_message",
            field=models.TextField(null=True),
        ),
        migrations.AddField(
            model_name="scheduledmessage",
            name="delivered_message",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.CASCADE, to="zerver.message"
            ),
        ),
    ]
