from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0034_tarefacomentario_imagem_tarefatrabalhista_prioridade_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tarefatrabalhista',
            name='prioridade',
            field=models.CharField(choices=[('BAIXA', 'Baixa'), ('MEDIA', 'Média'), ('ALTA', 'Alta')], default='MEDIA', max_length=10),
        ),
    ]
