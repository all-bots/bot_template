import { prisma } from "../../utils/db";

export async function index(req, res) {
  const messages = await prisma.message.findMany();
  res.render("index_message", {
    messages,
  });
}

export async function create(req, res) {
  try {
    const { message_id = 0, text = "" } = req.body;
    if (!message_id) {
      return res.json({
        is_error: true,
        message: "Message Id is required",
      });
    }
    if (!text) {
      return res.json({
        is_error: true,
        message: "Content is required",
      });
    }

    await prisma.message.create({
      data: {
        messageId: message_id,
        content: text,
      },
    });
    res.json({
      is_error: false,
    });
  } catch (error) {
    return res.json({
      is_error: true,
      message: error.message,
    });
  }
}

export async function deleteMessage(req, res) {
  try {
    const { id = 0 } = req.params;
    if (id) {
      await prisma.message.deleteMany({ where: { messageId: id } });
      res.json({
        is_error: false,
        message: "Delete successfully",
      });
    } else {
      res.json({
        is_error: true,
        message: "id is required",
      });
    }
  } catch (error: any) {
    res.json({
      is_error: true,
      message: error.message,
    });
  }
}
